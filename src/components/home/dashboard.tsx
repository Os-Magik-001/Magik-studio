import { Clapperboard } from "lucide-react";
import { displayName, type Role, type Viewer } from "@/lib/auth";
import { homeData } from "@/lib/home";
import { ensureWebsiteNotice } from "@/lib/website";
import { Greeting } from "@/components/home/greeting";
import { HiddenWidgets, Widget } from "@/components/home/widget";
import {
  ActivityPanel,
  ClientBrandPanel,
  ClientDocumentsPanel,
  InvoicesPanel,
  OnboardingPanel,
  OverviewPanel,
  Panel,
  ProductionPanel,
  TodayPanel,
  VideoList,
} from "@/components/home/panels";

const LINE: Record<Role, [string, string]> = {
  admin: ["Your entire business.", "One command center."],
  editor: ["Every edit, every client.", "One place."],
  seller: ["Every client, from the first call", "to their first video."],
  videographer: ["Your shoots and your footage.", "One place."],
  client: ["Your videos, your brand.", "All in one place."],
};

const NAMES: Record<string, string> = {
  today: "Today",
  overview: "Studio overview",
  production: "Production",
  onboarding: "Onboarding",
  invoices: "Invoices",
  activity: "Recent activity",
  videos: "Your videos",
  brand: "Your brand",
  documents: "Documents",
};

// Home, the desktop under the windows: the greeting and the day on top, then the panels that
// matter for the role, each opening its app.
export async function HomeDashboard({ viewer }: { viewer: Viewer }) {
  const [data] = await Promise.all([homeData(viewer), ensureWebsiteNotice(viewer)]);
  const role = viewer.role;

  const panels: { id: string; node: React.ReactNode }[] = [];
  if (data.client) {
    panels.push(
      {
        id: "videos",
        node: (
          <Panel id="videos" href="/review" title={data.client.toReview ? `Your videos · ${data.client.toReview} to review` : "Your videos"} icon={<Clapperboard size={16} className="text-accent" aria-hidden />}>
            <VideoList rows={data.client.videos} empty="Your first videos are on their way." />
          </Panel>
        ),
      },
      { id: "brand", node: <ClientBrandPanel logo={data.client.logo} colors={data.client.colors} fonts={data.client.fonts} /> },
      { id: "documents", node: <ClientDocumentsPanel invoice={data.client.invoice} contract={data.client.contract} /> },
    );
  } else {
    if (data.overview) panels.push({ id: "overview", node: <OverviewPanel data={data.overview} href={role === "seller" ? "/onboarding" : "/pipeline"} /> });
    if (data.production && role !== "seller")
      panels.push({ id: "production", node: <ProductionPanel rows={data.production.rows} deadlines={data.production.deadlines} href={role === "videographer" ? "/shoots" : "/pipeline"} /> });
    if (data.onboarding) panels.push({ id: "onboarding", node: <OnboardingPanel rows={data.onboarding.rows} open={data.onboarding.open} waiting={data.onboarding.waiting} /> });
    if (role === "seller" && data.invoices) panels.push({ id: "invoices", node: <InvoicesPanel rows={data.invoices.rows} outstanding={data.invoices.outstanding} currency={data.invoices.currency} /> });
    if (panels.length < 3) panels.push({ id: "activity", node: <ActivityPanel rows={data.activity} /> });
  }

  return (
    <div className="home relative z-0 mx-auto w-full max-w-[1680px] px-4 pt-[68px] pb-[150px] sm:px-8 lg:px-10">
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Greeting name={displayName(viewer)} line={LINE[role]} signature={role === "client" ? "Let's make magic." : "Make it happen."} />
        <Widget id="today" className="animate-rise-in [animation-delay:80ms] lg:h-[300px]">
          <TodayPanel items={data.today} href="/calendar" />
        </Widget>
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {panels.map((p, i) => (
          <Widget key={p.id} id={p.id} className="animate-rise-in xl:h-[max(360px,calc(100dvh-548px))] [&>section]:h-full" style={{ animationDelay: `${140 + i * 70}ms` }}>
            {p.node}
          </Widget>
        ))}
      </div>
      <HiddenWidgets names={NAMES} />
    </div>
  );
}
