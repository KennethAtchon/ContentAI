import { createFileRoute } from "@tanstack/react-router";
import { ContactMessagesView } from "@/domains/admin/ui/contact-messages/ContactMessagesView";

export const Route = createFileRoute("/admin/_layout/contactmessages")({
  component: ContactMessagesPage,
});

function ContactMessagesPage() {
  return <ContactMessagesView />;
}
