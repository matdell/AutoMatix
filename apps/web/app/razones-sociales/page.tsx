import { redirect } from 'next/navigation';

export default function RazonesSocialesRedirectPage() {
  redirect('/comercios?view=merchants');
}
