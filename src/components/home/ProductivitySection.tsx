import { ProductivityCard } from '@/components/ProductivityCard';

export default function ProductivitySection() {
  return (
    <section
      className="flex w-full flex-col items-center gap-10 pt-20"
      aria-labelledby="productivity-section-heading"
      itemScope
      itemType="https://schema.org/CreativeWork"
    >
      <ProductivityCard />
    </section>
  );
}
