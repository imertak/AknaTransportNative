import { Redirect } from 'expo-router';

/** Placeholder – tap is intercepted by the tab layout to open the new-job form. */
export default function CreatePlaceholder() {
  return <Redirect href="/admin/dashboard" />;
}
