import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pachu",
};

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
