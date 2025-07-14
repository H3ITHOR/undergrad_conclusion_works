/*
  Warnings:

  - You are about to drop the column `Advisor` on the `data` table. All the data in the column will be lost.
  - You are about to drop the column `Author` on the `data` table. All the data in the column will be lost.
  - You are about to drop the column `Co_Advisor` on the `data` table. All the data in the column will be lost.
  - You are about to drop the column `Course` on the `data` table. All the data in the column will be lost.
  - You are about to drop the column `Initial_proposal` on the `data` table. All the data in the column will be lost.
  - You are about to drop the column `Possible_appraiser` on the `data` table. All the data in the column will be lost.
  - You are about to drop the column `Proposal_abstract` on the `data` table. All the data in the column will be lost.
  - You are about to drop the column `raw` on the `data` table. All the data in the column will be lost.
  - Added the required column `advisor` to the `data` table without a default value. This is not possible if the table is not empty.
  - Added the required column `author` to the `data` table without a default value. This is not possible if the table is not empty.
  - Added the required column `course` to the `data` table without a default value. This is not possible if the table is not empty.
  - Added the required column `initial_proposal` to the `data` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proposal_abstract` to the `data` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semester` to the `data` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "data" DROP COLUMN "Advisor",
DROP COLUMN "Author",
DROP COLUMN "Co_Advisor",
DROP COLUMN "Course",
DROP COLUMN "Initial_proposal",
DROP COLUMN "Possible_appraiser",
DROP COLUMN "Proposal_abstract",
DROP COLUMN "raw",
ADD COLUMN     "advisor" TEXT NOT NULL,
ADD COLUMN     "author" TEXT NOT NULL,
ADD COLUMN     "co_Advisor" TEXT,
ADD COLUMN     "course" TEXT NOT NULL,
ADD COLUMN     "initial_proposal" TEXT NOT NULL,
ADD COLUMN     "possible_appraiser" TEXT,
ADD COLUMN     "proposal_abstract" TEXT NOT NULL,
ADD COLUMN     "semester" TEXT NOT NULL;
