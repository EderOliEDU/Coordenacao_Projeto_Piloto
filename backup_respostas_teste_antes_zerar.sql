--
-- PostgreSQL database dump
--

\restrict tjN6PgELtF1ZuXX9g6EYKgb2gPwDSZUy9h2b421EKDUfj1tdcz74gPyuKzfixaY

-- Dumped from database version 17.10 (Debian 17.10-0+deb13u1)
-- Dumped by pg_dump version 17.10 (Debian 17.10-0+deb13u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aluno_necessidades_contexto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aluno_necessidades_contexto (
    id_aluno integer NOT NULL,
    id_turma integer NOT NULL,
    cpf_professor text NOT NULL,
    paee boolean,
    apoio_pedagogico boolean,
    criada_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    atualizada_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.aluno_necessidades_contexto OWNER TO postgres;

--
-- Name: aluno_necessidades_especificas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aluno_necessidades_especificas (
    id_aluno_necespecifica bigint NOT NULL,
    id_aluno integer NOT NULL,
    id_turma integer NOT NULL,
    cpf_professor text NOT NULL,
    id_necespecifica integer,
    tipo text NOT NULL,
    descricao_outros text,
    criada_em timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT aluno_necessidades_especificas_tipo_check CHECK ((tipo = ANY (ARRAY['PAEE'::text, 'APOIO'::text])))
);


ALTER TABLE public.aluno_necessidades_especificas OWNER TO postgres;

--
-- Name: aluno_necessidades_especificas_id_aluno_necespecifica_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.aluno_necessidades_especificas_id_aluno_necespecifica_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aluno_necessidades_especificas_id_aluno_necespecifica_seq OWNER TO postgres;

--
-- Name: aluno_necessidades_especificas_id_aluno_necespecifica_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.aluno_necessidades_especificas_id_aluno_necespecifica_seq OWNED BY public.aluno_necessidades_especificas.id_aluno_necespecifica;


--
-- Name: avaliacao_respostas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.avaliacao_respostas (
    id_resposta integer NOT NULL,
    id_aluno integer,
    cpf_professor text,
    id_pergunta integer,
    id_opcao integer,
    data_avaliacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status text DEFAULT 'RASCUNHO'::text,
    observacao text
);


ALTER TABLE public.avaliacao_respostas OWNER TO postgres;

--
-- Name: avaliacao_respostas_id_resposta_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.avaliacao_respostas_id_resposta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.avaliacao_respostas_id_resposta_seq OWNER TO postgres;

--
-- Name: avaliacao_respostas_id_resposta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.avaliacao_respostas_id_resposta_seq OWNED BY public.avaliacao_respostas.id_resposta;


--
-- Name: submissoes_pg; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submissoes_pg (
    id bigint NOT NULL,
    cpf_professor character varying(11) NOT NULL,
    id_turma integer NOT NULL,
    id_aluno integer NOT NULL,
    formulario_id text NOT NULL,
    status text DEFAULT 'RASCUNHO'::text NOT NULL,
    observacoes text,
    criada_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizada_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.submissoes_pg OWNER TO postgres;

--
-- Name: submissoes_pg_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.submissoes_pg_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.submissoes_pg_id_seq OWNER TO postgres;

--
-- Name: submissoes_pg_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.submissoes_pg_id_seq OWNED BY public.submissoes_pg.id;


--
-- Name: aluno_necessidades_especificas id_aluno_necespecifica; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aluno_necessidades_especificas ALTER COLUMN id_aluno_necespecifica SET DEFAULT nextval('public.aluno_necessidades_especificas_id_aluno_necespecifica_seq'::regclass);


--
-- Name: avaliacao_respostas id_resposta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.avaliacao_respostas ALTER COLUMN id_resposta SET DEFAULT nextval('public.avaliacao_respostas_id_resposta_seq'::regclass);


--
-- Name: submissoes_pg id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissoes_pg ALTER COLUMN id SET DEFAULT nextval('public.submissoes_pg_id_seq'::regclass);


--
-- Data for Name: aluno_necessidades_contexto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.aluno_necessidades_contexto (id_aluno, id_turma, cpf_professor, paee, apoio_pedagogico, criada_em, atualizada_em) FROM stdin;
\.


--
-- Data for Name: aluno_necessidades_especificas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.aluno_necessidades_especificas (id_aluno_necespecifica, id_aluno, id_turma, cpf_professor, id_necespecifica, tipo, descricao_outros, criada_em) FROM stdin;
\.


--
-- Data for Name: avaliacao_respostas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.avaliacao_respostas (id_resposta, id_aluno, cpf_professor, id_pergunta, id_opcao, data_avaliacao, status, observacao) FROM stdin;
1	1777	00000000002	41	2	2026-05-26 16:13:46.875037	FINALIZADO	\N
2	1777	00000000002	44	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
3	1777	00000000002	45	2	2026-05-26 16:13:46.875037	FINALIZADO	\N
4	1777	00000000002	46	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
5	1777	00000000002	47	2	2026-05-26 16:13:46.875037	FINALIZADO	\N
6	1777	00000000002	48	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
7	1777	00000000002	49	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
8	1777	00000000002	50	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
9	1777	00000000002	51	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
10	1777	00000000002	52	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
11	1777	00000000002	53	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
12	1777	00000000002	54	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
13	1777	00000000002	55	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
14	1777	00000000002	56	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
15	1777	00000000002	57	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
16	1777	00000000002	58	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
17	1777	00000000002	59	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
18	1777	00000000002	60	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
19	1777	00000000002	61	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
20	1777	00000000002	62	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
21	1777	00000000002	63	2	2026-05-26 16:13:46.875037	FINALIZADO	\N
22	1777	00000000002	64	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
23	1777	00000000002	65	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
24	1777	00000000002	66	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
25	1777	00000000002	67	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
26	1777	00000000002	68	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
27	1777	00000000002	69	2	2026-05-26 16:13:46.875037	FINALIZADO	\N
28	1777	00000000002	70	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
29	1777	00000000002	71	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
30	1777	00000000002	72	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
31	1777	00000000002	73	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
32	1777	00000000002	74	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
33	1777	00000000002	75	2	2026-05-26 16:13:46.875037	FINALIZADO	\N
34	1777	00000000002	76	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
35	1777	00000000002	77	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
36	1777	00000000002	78	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
37	1777	00000000002	79	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
38	1777	00000000002	80	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
39	1777	00000000002	81	2	2026-05-26 16:13:46.875037	FINALIZADO	\N
40	1777	00000000002	82	3	2026-05-26 16:13:46.875037	FINALIZADO	\N
41	1777	00000000002	83	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
42	1777	00000000002	84	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
43	1777	00000000002	85	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
44	1777	00000000002	105	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
45	1777	00000000002	106	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
46	1777	00000000002	107	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
47	1777	00000000002	108	4	2026-05-26 16:13:46.875037	FINALIZADO	\N
48	1777	00000000002	109	5	2026-05-26 16:13:46.875037	FINALIZADO	\N
49	1759	00000000002	1	10	2026-05-27 15:17:44.62843	RASCUNHO	\N
50	1759	00000000002	2	9	2026-05-27 15:17:44.62843	RASCUNHO	\N
51	1759	00000000002	3	6	2026-05-27 15:17:44.62843	RASCUNHO	\N
52	1759	00000000002	4	2	2026-05-27 15:17:44.62843	RASCUNHO	\N
53	1759	00000000002	5	3	2026-05-27 15:17:44.62843	RASCUNHO	\N
54	1759	00000000002	6	4	2026-05-27 15:17:44.62843	RASCUNHO	\N
55	1759	00000000002	7	2	2026-05-27 15:17:44.62843	RASCUNHO	\N
\.


--
-- Data for Name: submissoes_pg; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.submissoes_pg (id, cpf_professor, id_turma, id_aluno, formulario_id, status, observacoes, criada_em, atualizada_em) FROM stdin;
1	06073493100	7934	3172	PG_V1	FINALIZADO	\N	2026-05-19 10:52:37.972546	2026-05-19 10:52:37.972546
2	06073493100	7934	3169	PG_V1	RASCUNHO	\N	2026-05-25 09:24:04.229667	2026-05-25 09:24:04.229667
3	00000000002	10215	1777	PG_V1	FINALIZADO	\N	2026-05-26 16:13:46.870795	2026-05-26 16:13:46.870795
4	00000000002	10215	1759	PG_V1	RASCUNHO	\N	2026-05-27 15:13:42.80705	2026-05-27 15:17:44.625081
\.


--
-- Name: aluno_necessidades_especificas_id_aluno_necespecifica_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.aluno_necessidades_especificas_id_aluno_necespecifica_seq', 1, false);


--
-- Name: avaliacao_respostas_id_resposta_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.avaliacao_respostas_id_resposta_seq', 55, true);


--
-- Name: submissoes_pg_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.submissoes_pg_id_seq', 5, true);


--
-- Name: aluno_necessidades_contexto aluno_necessidades_contexto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aluno_necessidades_contexto
    ADD CONSTRAINT aluno_necessidades_contexto_pkey PRIMARY KEY (id_aluno, id_turma, cpf_professor);


--
-- Name: aluno_necessidades_especificas aluno_necessidades_especificas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aluno_necessidades_especificas
    ADD CONSTRAINT aluno_necessidades_especificas_pkey PRIMARY KEY (id_aluno_necespecifica);


--
-- Name: avaliacao_respostas avaliacao_respostas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.avaliacao_respostas
    ADD CONSTRAINT avaliacao_respostas_pkey PRIMARY KEY (id_resposta);


--
-- Name: submissoes_pg submissoes_pg_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissoes_pg
    ADD CONSTRAINT submissoes_pg_pkey PRIMARY KEY (id);


--
-- Name: idx_aluno_necessidades_especificas_aluno_turma; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aluno_necessidades_especificas_aluno_turma ON public.aluno_necessidades_especificas USING btree (id_aluno, id_turma);


--
-- Name: idx_aluno_necessidades_especificas_unica; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_aluno_necessidades_especificas_unica ON public.aluno_necessidades_especificas USING btree (id_aluno, id_turma, cpf_professor, id_necespecifica) WHERE (id_necespecifica IS NOT NULL);


--
-- Name: uq_submissoes_pg; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_submissoes_pg ON public.submissoes_pg USING btree (cpf_professor, id_turma, id_aluno, formulario_id);


--
-- Name: aluno_necessidades_especificas aluno_necessidades_especificas_necespecifica_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aluno_necessidades_especificas
    ADD CONSTRAINT aluno_necessidades_especificas_necespecifica_fkey FOREIGN KEY (id_necespecifica) REFERENCES public."necessidades_específicas"(id_necespecifica);


--
-- Name: avaliacao_respostas avaliacao_respostas_cpf_professor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.avaliacao_respostas
    ADD CONSTRAINT avaliacao_respostas_cpf_professor_fkey FOREIGN KEY (cpf_professor) REFERENCES public.professores(profissional_cpf);


--
-- Name: avaliacao_respostas avaliacao_respostas_id_aluno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.avaliacao_respostas
    ADD CONSTRAINT avaliacao_respostas_id_aluno_fkey FOREIGN KEY (id_aluno) REFERENCES public.alunos(id_aluno);


--
-- Name: avaliacao_respostas avaliacao_respostas_id_opcao_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.avaliacao_respostas
    ADD CONSTRAINT avaliacao_respostas_id_opcao_fkey FOREIGN KEY (id_opcao) REFERENCES public.avaliacao_opcoes(id_opcao);


--
-- Name: avaliacao_respostas avaliacao_respostas_id_pergunta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.avaliacao_respostas
    ADD CONSTRAINT avaliacao_respostas_id_pergunta_fkey FOREIGN KEY (id_pergunta) REFERENCES public.avaliacao_perguntas(id_pergunta);


--
-- Name: submissoes_pg submissoes_pg_cpf_professor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissoes_pg
    ADD CONSTRAINT submissoes_pg_cpf_professor_fkey FOREIGN KEY (cpf_professor) REFERENCES public.professores(profissional_cpf);


--
-- Name: submissoes_pg submissoes_pg_id_aluno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissoes_pg
    ADD CONSTRAINT submissoes_pg_id_aluno_fkey FOREIGN KEY (id_aluno) REFERENCES public.alunos(id_aluno);


--
-- Name: submissoes_pg submissoes_pg_id_turma_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissoes_pg
    ADD CONSTRAINT submissoes_pg_id_turma_fkey FOREIGN KEY (id_turma) REFERENCES public.turmas(id_turma);


--
-- PostgreSQL database dump complete
--

\unrestrict tjN6PgELtF1ZuXX9g6EYKgb2gPwDSZUy9h2b421EKDUfj1tdcz74gPyuKzfixaY

