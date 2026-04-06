import { redirect } from 'next/navigation';

export default function RetailersRedirectPage() {
  redirect('/comercios?view=brands');
}
