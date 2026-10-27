import { redirect } from "next/navigation";
import { getRepo } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  redirect((await getRepo().getSession()) ? "/today" : "/login");
}
