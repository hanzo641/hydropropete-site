import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { JsonLd } from "@/components/json-ld";

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <>
      <Accordion type="single" collapsible className="rounded-2xl border bg-card px-6">
        {items.map((item, i) => (
          <AccordionItem key={item.q} value={`q${i}`}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
        }}
      />
    </>
  );
}
