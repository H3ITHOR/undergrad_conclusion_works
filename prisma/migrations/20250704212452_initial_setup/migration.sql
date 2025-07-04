-- CreateTable
CREATE TABLE "data" (
    "id" SERIAL NOT NULL,
    "raw" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tg" TEXT,
    "Initial_proposal" TEXT NOT NULL,
    "Author" TEXT NOT NULL,
    "Course" TEXT NOT NULL,
    "Advisor" TEXT NOT NULL,
    "Co_Advisor" TEXT,
    "Possible_appraiser" TEXT,
    "Proposal_abstract" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "evaluation_panel" TEXT NOT NULL,
    "local" TEXT,
    "key_words" TEXT,

    CONSTRAINT "data_pkey" PRIMARY KEY ("id")
);
