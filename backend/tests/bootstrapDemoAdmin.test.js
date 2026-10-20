jest.mock('../src/config/db', () => ({
    pool: { connect: jest.fn() }
}));

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');
const { bootstrapDemoAdmin } = require('../src/services/bootstrapDemoAdmin');

const entornoOriginal = { ...process.env };

const configurarEntorno = (valores = {}) => {
    process.env.DEMO_ADMIN_ENABLED = 'true';
    process.env.DEMO_ADMIN_NAME = 'Grupo 4';
    process.env.DEMO_ADMIN_EMAIL = 'grupo4@gmail.com';
    process.env.DEMO_ADMIN_PASSWORD = 'clave-de-prueba';
    Object.assign(process.env, valores);
};

const crearCliente = () => ({
    query: jest.fn(),
    release: jest.fn()
});

describe('bootstrapDemoAdmin', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...entornoOriginal };
    });

    afterAll(() => {
        process.env = { ...entornoOriginal };
    });

    test('no conecta a la base si el bootstrap está desactivado', async () => {
        process.env.DEMO_ADMIN_ENABLED = 'false';

        await expect(bootstrapDemoAdmin()).resolves.toBeUndefined();
        expect(pool.connect).not.toHaveBeenCalled();
    });

    test('rechaza configuración incompleta antes de conectar a la base', async () => {
        configurarEntorno({ DEMO_ADMIN_PASSWORD: '' });

        await expect(bootstrapDemoAdmin()).rejects.toThrow('DEMO_ADMIN_PASSWORD');
        expect(pool.connect).not.toHaveBeenCalled();
    });

    test('no modifica una cuenta que ya existe', async () => {
        configurarEntorno();
        const client = crearCliente();
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // set tenant bypass
            .mockResolvedValueOnce({}) // advisory lock
            .mockResolvedValueOnce({ rows: [{ id_usuario: 'usuario-existente' }] })
            .mockResolvedValueOnce({}); // COMMIT
        pool.connect.mockResolvedValueOnce(client);

        await bootstrapDemoAdmin();

        expect(client.query).toHaveBeenCalledWith(
            'SELECT id_usuario FROM usuarios WHERE lower(correo) = lower($1) LIMIT 1',
            ['grupo4@gmail.com']
        );
        expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false);
        expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('crea empresa, roles y admin con hash bcrypt dentro de una transacción', async () => {
        configurarEntorno();
        const client = crearCliente();
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // set tenant bypass
            .mockResolvedValueOnce({}) // advisory lock
            .mockResolvedValueOnce({ rows: [] }) // user check
            .mockResolvedValueOnce({ rows: [{ id_empresa: 'empresa-nueva' }] }) // company insert
            .mockResolvedValueOnce({}) // roles insert
            .mockResolvedValueOnce({}) // user insert
            .mockResolvedValueOnce({}); // COMMIT
        pool.connect.mockResolvedValueOnce(client);

        await bootstrapDemoAdmin();

        const insertarRoles = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO roles_empresa'));
        expect(insertarRoles[1]).toEqual(['empresa-nueva']);

        const insertarUsuario = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO usuarios'));
        expect(insertarUsuario[1].slice(0, 3)).toEqual([
            'empresa-nueva', 'Grupo 4', 'grupo4@gmail.com'
        ]);
        await expect(bcrypt.compare('clave-de-prueba', insertarUsuario[1][3])).resolves.toBe(true);
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('revierte la transacción y libera conexión si falla una consulta', async () => {
        configurarEntorno();
        const client = crearCliente();
        client.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('database error')) // set tenant bypass
            .mockResolvedValueOnce({}); // ROLLBACK
        pool.connect.mockResolvedValueOnce(client);

        await expect(bootstrapDemoAdmin()).rejects.toThrow('database error');
        expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
        expect(client.release).toHaveBeenCalledTimes(1);
    });
});
