-- Customer records now hold only contact details, lead source, the car and its quotation, plus
-- the deal's stage (Lead → Won, or Lost). Remove everything else from existing records; the
-- customers route strips these fields from future saves too.
UPDATE customers
SET data = json_remove(
  data,
  -- identity details
  '$.icNo', '$.address', '$.email', '$.drivingLicenceNo', '$.plateNo', '$.chassisNo', '$.engineNo',
  -- insurer and document status
  '$.insuranceName', '$.documentStatus',
  -- post-approval loan details (the quotation is the only financial record now)
  '$.bankPanel', '$.loanAmount', '$.loanTenureMonths', '$.loanInterestRate', '$.downpayment', '$.ncd',
  -- trade-in
  '$.tradeInStatus', '$.tradeInVehicle', '$.tradeInValue',
  -- delivery details
  '$.deliveryDate', '$.deliveryNotes'
);

-- A booked car stays a Lead until it's delivered; delivery is when a deal is Won; Cancelled is
-- renamed Lost.
UPDATE customers SET status = 'Lead', data = json_set(data, '$.status', 'Lead') WHERE status IN ('Booked', 'In Progress');
UPDATE customers SET status = 'Won', data = json_set(data, '$.status', 'Won') WHERE status = 'Delivered';
UPDATE customers SET status = 'Lost', data = json_set(data, '$.status', 'Lost') WHERE status = 'Cancelled';
UPDATE customers SET data = json_set(data, '$.previousStatus', 'Lead') WHERE json_extract(data, '$.previousStatus') IN ('Booked', 'In Progress');
UPDATE customers SET data = json_set(data, '$.previousStatus', 'Won') WHERE json_extract(data, '$.previousStatus') = 'Delivered';

-- Activity log: drop the plate number from old delivery entries ("Delivery completed · VAA 2281"),
-- and rename Cancelled → Lost. (Old "→ Delivered" entries stay as history; the app reads them as
-- the day an old deal was won.)
UPDATE customers
SET data = json_set(
  data,
  '$.activity',
  (
    SELECT json_group_array(
      CASE
        WHEN json_extract(entry.value, '$.message') LIKE 'Delivery completed%'
          THEN json_set(entry.value, '$.message', 'Delivery completed')
        WHEN json_extract(entry.value, '$.message') LIKE '%Cancelled%'
          THEN json_set(entry.value, '$.message', replace(replace(json_extract(entry.value, '$.message'), '→ Cancelled', '→ Lost'), 'Reopened: Cancelled →', 'Reopened: Lost →'))
        ELSE json(entry.value)
      END
    )
    FROM json_each(customers.data, '$.activity') AS entry
  )
)
WHERE json_type(data, '$.activity') = 'array';
