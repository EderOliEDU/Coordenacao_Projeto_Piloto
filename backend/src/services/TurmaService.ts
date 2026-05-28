import { getPgPool } from './pgPool';

const getTurmasComFinalizados = async () => {
  const pool = getPgPool();

  // Busque as turmas
  const turmas = await pool.query('SELECT id, nome FROM turmas');

  const resultados = [];

  for (const turma of turmas.rows) {
    // Quantidade total de alunos
    const totalAlunosResult = await pool.query('SELECT COUNT(*) FROM alunos WHERE turma_id = $1', [turma.id]);
    const totalAlunos = parseInt(totalAlunosResult.rows[0].count, 10);

    // Quantidade de alunos com Finalizada = true
    const totalFinalizadosResult = await pool.query(
      'SELECT COUNT(*) FROM alunos WHERE turma_id = $1 AND finalizada = true', [turma.id]
    );
    const totalFinalizados = parseInt(totalFinalizadosResult.rows[0].count, 10);

    resultados.push({
      id: turma.id,
      nome: turma.nome,
      totalAlunos,
      totalFinalizados
    });
  }

  return resultados;
};

export default { getTurmasComFinalizados };