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

  // Validate destination to prevent open redirect
  if (redirect?.destinationPath) {
    const dest = redirect.destinationPath;
    // Only allow relative paths — block absolute URLs, protocol handlers, and //example.com
    if (!dest.startsWith('/') || dest.startsWith('//')) {
      return NextResponse.json({ redirect: null });
    }
  }

  return NextResponse.json({ redirect });
}
