-- Non-negativity floor for the goal display target, matching the money-column CHECKs in the
-- init migration (defence-in-depth behind the zod bound). Not expressible in Prisma PSL, so it
-- lives only here. NULL goalBase is allowed (CHECK passes on NULL).
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_goalBase_nonneg" CHECK ("goalBase" >= 0);
