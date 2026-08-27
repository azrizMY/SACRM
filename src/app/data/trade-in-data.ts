export type TradeInContactRecord = {
  id: string;
  name: string;
  // Two distinct, independently optional ways a contact gave contact — a real phone number, or a
  // WhatsApp username/handle with no number attached. At least one of the two must be present
  // (enforced by canSubmitTradeInContact), but neither is required on its own.
  phone?: string;
  username?: string;
  company: string;
  state: string;
  branch?: string;
  notes?: string;
  favourite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type NewTradeInContactInput = {
  name: string;
  phone?: string;
  username?: string;
  company: string;
  state: string;
  branch?: string;
  notes?: string;
};

export type EditTradeInContactInput = Partial<Omit<TradeInContactRecord, 'id' | 'favourite' | 'createdAt' | 'updatedAt'>>;

function hasUsername(value?: string): boolean {
  const trimmed = value?.trim();
  return !!trimmed && trimmed !== '@';
}

export function canSubmitTradeInContact(input: { name: string; phone?: string; username?: string; company: string; state: string }): boolean {
  return !!input.name.trim() && !!input.company.trim() && !!input.state && (!!input.phone?.trim() || hasUsername(input.username));
}
