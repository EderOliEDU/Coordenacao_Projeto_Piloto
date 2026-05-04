-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Formulario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versao" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SecaoFormulario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "formularioId" TEXT NOT NULL,
    CONSTRAINT "SecaoFormulario_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "Formulario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EscalaResposta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "OpcaoEscala" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT,
    "ordem" INTEGER NOT NULL,
    "escalaId" TEXT NOT NULL,
    CONSTRAINT "OpcaoEscala_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "EscalaResposta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pergunta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "secaoId" TEXT NOT NULL,
    "escalaId" TEXT NOT NULL,
    CONSTRAINT "Pergunta_secaoId_fkey" FOREIGN KEY ("secaoId") REFERENCES "SecaoFormulario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pergunta_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "EscalaResposta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submissao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formularioId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "alunoId" TEXT,
    "turmaId" TEXT,
    "escolaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submissao_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "Formulario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resposta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissaoId" TEXT NOT NULL,
    "perguntaId" TEXT NOT NULL,
    "opcaoId" TEXT NOT NULL,
    CONSTRAINT "Resposta_submissaoId_fkey" FOREIGN KEY ("submissaoId") REFERENCES "Submissao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Resposta_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "Pergunta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Resposta_opcaoId_fkey" FOREIGN KEY ("opcaoId") REFERENCES "OpcaoEscala" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Formulario_versao_key" ON "Formulario"("versao");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaResposta_nome_key" ON "EscalaResposta"("nome");
