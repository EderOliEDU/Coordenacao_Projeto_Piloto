import net from 'net'
import tls from 'tls'

type SmtpConfig = {
  host: string
  port: number
  user?: string
  pass?: string
  from: string
  secure: boolean
  starttls: boolean
}

function getConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  if (!host) throw new Error('SMTP_HOST não configurado')
  if (!from) throw new Error('SMTP_FROM não configurado')

  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from,
    secure: (process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    starttls: (process.env.SMTP_STARTTLS ?? 'true').toLowerCase() !== 'false',
  }
}

function encodeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

function address(value: string) {
  return `<${value.replace(/[<>]/g, '')}>`
}

class SmtpClient {
  private socket: net.Socket | tls.TLSSocket
  private buffer = ''

  constructor(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket
    this.socket.setEncoding('utf8')
    this.socket.on('data', (chunk) => {
      this.buffer += chunk
    })
  }

  static connect(config: SmtpConfig): Promise<SmtpClient> {
    return new Promise((resolve, reject) => {
      const socket = config.secure
        ? tls.connect(config.port, config.host, { servername: config.host })
        : net.connect(config.port, config.host)

      socket.once('error', reject)
      socket.once('connect', () => {
        socket.removeListener('error', reject)
        resolve(new SmtpClient(socket))
      })
    })
  }

  async read(expected: number[]) {
    const line = await this.readLine()
    const code = Number(line.slice(0, 3))
    if (!expected.includes(code)) throw new Error(`SMTP inesperado: ${line.trim()}`)
    return line
  }

  async command(command: string, expected: number[]) {
    this.socket.write(`${command}\r\n`)
    return this.read(expected)
  }

  async startTls(config: SmtpConfig) {
    await this.command('STARTTLS', [220])
    this.socket = tls.connect({ socket: this.socket, servername: config.host })
    this.socket.setEncoding('utf8')
    this.socket.on('data', (chunk) => {
      this.buffer += chunk
    })
    await new Promise<void>((resolve, reject) => {
      this.socket.once('secureConnect', () => resolve())
      this.socket.once('error', reject)
    })
  }

  async auth(config: SmtpConfig) {
    if (!config.user || !config.pass) return
    await this.command('AUTH LOGIN', [334])
    await this.command(Buffer.from(config.user).toString('base64'), [334])
    await this.command(Buffer.from(config.pass).toString('base64'), [235])
  }

  async data(message: string) {
    await this.command('DATA', [354])
    this.socket.write(`${message}\r\n.\r\n`)
    await this.read([250])
  }

  end() {
    this.socket.end()
  }

  private readLine(): Promise<string> {
    return new Promise((resolve, reject) => {
      const tryResolve = () => {
        const complete = this.buffer.split(/\r?\n/).find((line) => /^\d{3} /.test(line))
        if (!complete) return
        this.buffer = ''
        cleanup()
        resolve(complete)
      }

      const onData = () => tryResolve()
      const onError = (err: Error) => {
        cleanup()
        reject(err)
      }
      const cleanup = () => {
        this.socket.removeListener('data', onData)
        this.socket.removeListener('error', onError)
      }

      this.socket.on('data', onData)
      this.socket.once('error', onError)
      tryResolve()
    })
  }
}

export async function sendPasswordSetupEmail(to: string, nome: string, link: string) {
  const config = getConfig()
  const client = await SmtpClient.connect(config)
  const subject = 'Cadastro de senha - Projeto Instrução Fônica'
  const body = [
    `Olá, ${nome}.`,
    '',
    'Recebemos uma solicitação para cadastrar sua senha de acesso ao Projeto Instrução Fônica.',
    '',
    'Clique no link abaixo para cadastrar sua senha:',
    link,
    '',
    'Este link expira em 2 horas.',
    '',
    'Se você não solicitou esse cadastro, ignore esta mensagem.',
  ].join('\r\n')

  const message = [
    `From: ${address(config.from)}`,
    `To: ${address(to)}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
  ].join('\r\n')

  try {
    await client.read([220])
    await client.command(`EHLO ${process.env.SMTP_EHLO || 'localhost'}`, [250])
    if (!config.secure && config.starttls) {
      await client.startTls(config)
      await client.command(`EHLO ${process.env.SMTP_EHLO || 'localhost'}`, [250])
    }
    await client.auth(config)
    await client.command(`MAIL FROM:${address(config.from)}`, [250])
    await client.command(`RCPT TO:${address(to)}`, [250, 251])
    await client.data(message)
    await client.command('QUIT', [221])
  } finally {
    client.end()
  }
}
