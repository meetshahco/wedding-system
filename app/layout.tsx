import type { Metadata } from "next";
import MuiProvider from "@/components/MuiProvider";
import { inter } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Wedding Invitation Manager",
  description: "Wedding invitation management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <MuiProvider>{children}</MuiProvider>
      </body>
    </html>
  );
}
