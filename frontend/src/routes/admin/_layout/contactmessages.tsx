import { createFileRoute } from "@tanstack/react-router";
import { ContactMessagesView } from "@/features/admin/components/contact-messages/ContactMessagesView";

export const Route = createFileRoute("/admin/_layout/contactmessages")({
  component: ContactMessagesPage,
});

function ContactMessagesPage() {
  return <ContactMessagesView />;
}
