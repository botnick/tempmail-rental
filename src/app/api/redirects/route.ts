/**
 * Redirect API Route
 *
 * Handles CMS-managed redirects. Called by middleware to check
 * if a path needs to be redirected before rendering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db';

export async function GET(request: NextRequest) {
  const sourcePath = request.nextUrl.searchParams.get('path');

  if (!sourcePath) {
    return NextResponse.json({ redirect: null });
  }

  const redirect = await prisma.redirect.findFirst({
    where: {
      sourcePath,
      isActive: true,
    },
    select: {
      destinationPath: true,
      isPermanent: true,
    },
  });

  return NextResponse.json({ redirect });
}
