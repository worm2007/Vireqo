import { Suspense } from "react";
import OpportunitiesClient from "./OpportunitiesClient";

export const dynamic = "force-dynamic";

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<main className="dashboard-page"><p>Loading opportunities...</p></main>}>
      <OpportunitiesClient />
    </Suspense>
  );
}
