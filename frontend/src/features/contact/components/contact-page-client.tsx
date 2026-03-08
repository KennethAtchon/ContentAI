/**
 * Contact Page Client Component - Modern SaaS Design
 *
 * Client-side contact page component.
 */

"use client";

import { useState } from "react";
import ContactForm from "@/features/contact/components/contact-form";
import ThankYouDialog from "@/features/contact/components/thank-you-dialog";

export default function ContactPageClient() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleFormSuccess = () => setIsModalOpen(true);

  return (
    <>
      <ContactForm onSuccess={handleFormSuccess} />
      <ThankYouDialog isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  );
}
