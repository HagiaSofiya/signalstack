import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { JetBrains_Mono, Merriweather } from "next/font/google";
import { cn } from "@/lib/utils";

const merriweatherHeading = Merriweather({subsets:['latin'],variable:'--font-heading'});

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  title: "SignalStack | AI analytics workspace",
  description: "A focused workspace for exploring datasets with an AI agent.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={cn("font-mono", jetbrainsMono.variable, merriweatherHeading.variable)}>
      <body>{children}</body>
    </html>
  );
}
