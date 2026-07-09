import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <InstallPrompt />
    </>
  );
}
