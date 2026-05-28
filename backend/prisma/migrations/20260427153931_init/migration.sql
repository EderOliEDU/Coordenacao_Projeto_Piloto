-- CreateTable
CREATE TABLE "Escola" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "municipio" TEXT,
    "uf" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "anoLetivo" INTEGER NOT NULL,
    "turno" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "escolaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Turma_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "email" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProfessorTurma" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "professorId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    CONSTRAINT "ProfessorTurma_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProfessorTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Aluno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT,
    "nome" TEXT NOT NULL,
    "dataNascimento" DATETIME,
    "sexo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "turmaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Aluno_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Formulario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "publicadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SecaoFormulario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formularioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "SecaoFormulario_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "Formulario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EscalaResposta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nomeExibicao" TEXT NOT NULL,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "OpcaoEscala" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escalaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "corHex" TEXT,
    "rotuloUI" TEXT NOT NULL,
    "descricaoLegenda" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OpcaoEscala_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "EscalaResposta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pergunta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secaoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'UNICA_ESCOLHA',
    "obrigatoria" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL,
    "ajuda" TEXT,
    "escalaId" TEXT,
    CONSTRAINT "Pergunta_secaoId_fkey" FOREIGN KEY ("secaoId") REFERENCES "SecaoFormulario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pergunta_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "EscalaResposta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submissao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formularioId" TEXT NOT NULL,
    "escolaId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "observacoes" TEXT,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submissao_formularioId_fkey" FOREIGN KEY ("formularioId") REFERENCES "Formulario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submissao_escolaId_fkey" FOREIGN KEY ("escolaId") REFERENCES "Escola" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submissao_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submissao_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "Aluno" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubmissaoProfessor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissaoId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'RESPONSAVEL',
    "assinouEm" DATETIME,
    CONSTRAINT "SubmissaoProfessor_submissaoId_fkey" FOREIGN KEY ("submissaoId") REFERENCES "Submissao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubmissaoProfessor_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Resposta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissaoId" TEXT NOT NULL,
    "perguntaId" TEXT NOT NULL,
    "opcaoEscalaId" TEXT NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" DATETIME NOT NULL,
    CONSTRAINT "Resposta_submissaoId_fkey" FOREIGN KEY ("submissaoId") REFERENCES "Submissao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Resposta_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "Pergunta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Resposta_opcaoEscalaId_fkey" FOREIGN KEY ("opcaoEscalaId") REFERENCES "OpcaoEscala" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Professor_login_key" ON "Professor"("login");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessorTurma_professorId_turmaId_key" ON "ProfessorTurma"("professorId", "turmaId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalaResposta_codigo_key" ON "EscalaResposta"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "OpcaoEscala_escalaId_chave_key" ON "OpcaoEscala"("escalaId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissaoProfessor_submissaoId_professorId_key" ON "SubmissaoProfessor"("submissaoId", "professorId");

-- CreateIndex
CREATE UNIQUE INDEX "Resposta_submissaoId_perguntaId_key" ON "Resposta"("submissaoId", "perguntaId");
