const { Pool } = require('pg');

// Credenciales de la cuenta de bajo privilegio para que el RLS aplique.
// Se leen de variables de entorno (ver .env / docker-compose). Nunca hardcodear secretos.
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_APP_USER || 'app_user',
    password: process.env.DB_APP_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

/**
 * Ejecuta consultas a PostgreSQL inyectando el contexto RLS de forma segura.
 * @param {string} idEmpresa - UUID del tenant extraído del JWT.
 * @param {string} query - Sentencia SQL parametrizada.
 * @param {Array} params - Valores de la consulta.
 */
const queryConRLS = async (idEmpresa, query, params = []) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Habilitar RLS inyectando la variable de sesión de PostgreSQL
        // Se usa set_config() con parámetros para EVITAR SQL Injection (is_local=true requiere BEGIN/COMMIT)
        await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [idEmpresa]);
        
        // Ejecutar la consulta de negocio en el contexto aislado
        const result = await client.query(query, params);
        
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[ERROR BD]:", error.message);
        throw error;
    } finally {
        // Obligatorio: Liberar el cliente al pool para evitar fugas de memoria (Memory Leaks)
        client.release();
    }
};

/**
 * Ejecuta varias escrituras dentro de UNA sola transaccion compartiendo el
 * contexto RLS del tenant (patron multi-escritura atomica). A diferencia de
 * queryConRLS, abre un unico BEGIN/COMMIT y expone un ejecutor `exec` para que
 * todas las sentencias de `fn` corran sobre el mismo client. Si `fn` lanza, se
 * hace ROLLBACK y se re-lanza el error.
 *
 * @param {string} idEmpresa - UUID del tenant extraido del JWT.
 * @param {(exec: (sql: string, params?: Array) => Promise) => Promise} fn - Logica de negocio.
 * @returns {Promise} el valor devuelto por `fn`.
 */
const conTransaccionRLS = async (idEmpresa, fn) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Habilitar RLS inyectando la variable de sesion (is_local=true requiere BEGIN/COMMIT).
        await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [idEmpresa]);
        // Ejecutor compartido: todas las queries de `fn` corren sobre el mismo client/transaccion.
        const exec = (sql, params = []) => client.query(sql, params);
        const resultado = await fn(exec);
        await client.query('COMMIT');
        return resultado;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("[ERROR BD]:", error.message);
        throw error;
    } finally {
        // Obligatorio: liberar el cliente al pool para evitar fugas de memoria.
        client.release();
    }
};

module.exports = { pool, queryConRLS, conTransaccionRLS };
