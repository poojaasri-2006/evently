-- Add organizer attribution to reviews
ALTER TABLE "Review" ADD COLUMN "organizerId" TEXT;
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "OrganizerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
