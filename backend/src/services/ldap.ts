import ldap from 'ldapjs';

export interface LdapUser {
  login: string;
  nome: string;
  email: string;
}

/** Escape special LDAP filter characters to prevent injection (RFC 4515) */
function escapeLdapFilter(value: string): string {
  return value.replace(/[\\*()\x00/<>,;+="&]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

export async function authenticate(login: string, password: string): Promise<LdapUser> {
  if (process.env.LDAP_MOCK === 'true') {
    // Mock mode: accept any password, return mock user
    return { login, nome: login, email: `${login}@escola.local` };
  }

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: process.env.LDAP_URL! });

    client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!, (bindErr) => {
      if (bindErr) {
        client.destroy();
        return reject(new Error('Falha ao conectar ao servidor LDAP'));
      }

      const safeLogin = escapeLdapFilter(login);
      const searchFilter = (process.env.LDAP_SEARCH_FILTER || '(sAMAccountName={{username}})').replace('{{username}}', safeLogin);

      client.search(
        process.env.LDAP_BASE_DN!,
        { filter: searchFilter, scope: 'sub', attributes: ['dn', 'cn', 'mail', 'sAMAccountName'] },
        (searchErr, searchRes) => {
          if (searchErr) {
            client.destroy();
            return reject(new Error('Erro ao buscar usuário no LDAP'));
          }

          let userDn: string | null = null;
          let userName = login;
          let userEmail = '';

          searchRes.on('searchEntry', (entry) => {
            userDn = entry.dn.toString();
            const obj = entry.pojo;
            obj.attributes.forEach((attr: any) => {
              if (attr.type === 'cn') userName = attr.values[0];
              if (attr.type === 'mail') userEmail = attr.values[0];
            });
          });

          searchRes.on('end', () => {
            if (!userDn) {
              client.destroy();
              return reject(new Error('Usuário não encontrado'));
            }

            client.bind(userDn, password, (userBindErr) => {
              client.destroy();
              if (userBindErr) return reject(new Error('Senha inválida'));
              resolve({ login, nome: userName, email: userEmail });
            });
          });

          searchRes.on('error', (err) => {
            client.destroy();
            reject(err);
          });
        }
      );
    });
  });
}
