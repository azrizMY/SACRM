export type AdvisorProfile = {
  name: string;
  role: string;
  email: string;
  phoneDisplay: string;
  phoneWa: string;
  bio: string;
};

export const DEFAULT_ADVISOR: AdvisorProfile = {
  name: 'Aiman Rashid',
  role: 'Sales Consultant',
  email: 'aiman@redlineauto.my',
  phoneDisplay: '017-648 5681',
  phoneWa: '60176485681',
  bio: 'Helping customers find the right car and the right deal, from first test drive to delivery day.',
};
