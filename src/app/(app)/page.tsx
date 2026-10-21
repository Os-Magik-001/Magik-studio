import { ViewTransition } from "react";
import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { displayName, getViewer, type Role } from "@/lib/auth";
import { homeData } from "@/lib/home";
import { Greeting } from "@/components/home/greeting";
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

export const metadata: Metadata = { title: { absolute: "Magik OS" } };

const LINE: Record<Role, [string, string]> = {
  admin: ["Your entire business.", "One command center."],
  editor: ["Every edit, every client.", "One place."],
  seller: ["Every client, from the first call", "to their first video."],
  videographer: ["Your shoots and your footage.", "One place."],
  client: ["Your videos, your brand.", "All in one place."],
};

const TODAY_HREF: Record<Role, string> = {
  admin: "/pipeline",
  editor: "/pipeline",
  seller: "/onboarding",
  videographer: "/shoots",
  client: "/review",
};

// Home: the command center. The greeting and the day on top, then the panels that matter for
// the role, each opening its app.
export default async function Home() {
  const viewer = await getViewer();
  const data = await homeData(viewer);
  const role = viewer.role;

  const panels = [];
  if (data.client) {
    panels.push(
      <Panel key="videos" title={data.client.toReview ? `Your videos · ${data.client.toReview} to review` : "Your videos"} icon={<Clapperboard size={16} className="text-accent" aria-hidden />}>
        <VideoList rows={data.client.videos} empty="Your first videos are on their way." />
      </Panel>,
      <ClientBrandPanel key="brand" logo={data.client.logo} colors={data.client.colors} fonts={data.client.fonts} />,
      <ClientDocumentsPanel key="docs" invoice={data.client.invoice} contract={data.client.contract} />,
    );
  } else {
    if (data.overview) panels.push(<OverviewPanel key="overview" data={data.overview} />);
    if (data.production && role !== "seller") panels.push(<ProductionPanel key="production" rows={data.production.rows} deadlines={data.production.deadlines} href={role === "videographer" ? "/shoots" : "/pipeline"} />);
    if (data.onboarding) panels.push(<OnboardingPanel key="onboarding" rows={data.onboarding.rows} open={data.onboarding.open} waiting={data.onboarding.waiting} />);
    if (role === "seller" && data.invoices) panels.push(<InvoicesPanel key="invoices" rows={data.invoices.rows} outstanding={data.invoices.outstanding} currency={data.invoices.currency} />);
    if (panels.length < 3) panels.push(<ActivityPanel key="activity" rows={data.activity} />);
  }

  return (
    <ViewTransition enter="home-in" exit="home-out" default="none">
      <div className="home relative z-0 mx-auto w-full max-w-[1680px] px-4 pt-[68px] pb-[150px] sm:px-8 lg:px-10">
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          <Greeting name={displayName(viewer)} line={LINE[role]} signature={role === "client" ? "Let's make magic." : "Make it happen."} />
          <div className="animate-rise-in [animation-delay:80ms] lg:h-[300px]">
            <TodayPanel items={data.today} href={TODAY_HREF[role]} />
          </div>
        </div>
        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {panels.map((p, i) => (
            <div key={i} className="animate-rise-in xl:h-[max(360px,calc(100dvh-548px))] [&>section]:h-full" style={{ animationDelay: `${140 + i * 70}ms` }}>
              {p}
            </div>
          ))}
        </div>
      </div>
    </ViewTransition>
  );
}
