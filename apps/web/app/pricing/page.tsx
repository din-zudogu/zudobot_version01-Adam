import { Header }        from "@/components/layout/Header";
import { Footer }        from "@/components/layout/Footer";
import { PricingSectionLoader } from "@/components/landing/PricingSectionLoader";

export const metadata = { title: "ราคาและแพ็กเกจ" };

export default function PricingPage() {
  return (
    <>
      <Header />
      <main className="pt-24">
        <PricingSectionLoader />
      </main>
      <Footer />
    </>
  );
}
