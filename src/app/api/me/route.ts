import { NextResponse } from "next/server";

import { apiHandler, requireApiAuth } from "@/server/api";
import type { MeResponse } from "@/types/api";

export const GET = apiHandler(async () => {
  const { user } = await requireApiAuth();

  const body: MeResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return NextResponse.json(body);
});
