// Classic JSX (React in scope) so no per-function deno.json is needed to bundle these.
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@1.0.10'
// @ts-types="npm:@types/react@19.1.8"
import React, { type ReactNode } from 'npm:react@19.1.0'

export const C = {
  primary: '#2b5cc6',
  ink: '#142033',
  ink2: '#34405a',
  muted: '#586579',
  bg: '#ebf0f7',
  line: '#d9e0ec',
  ok: '#15803d',
  danger: '#b42318',
  warn: '#9a4a07',
}

const font = "'Plus Jakarta Sans', -apple-system, 'Segoe UI', Arial, sans-serif"

/** LAIRON EZ branded shell: mobile-friendly single column (max 560px), no external images. */
export function Layout({
  preview,
  title,
  children,
}: {
  preview: string
  title: string
  children: ReactNode
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: C.bg,
          margin: 0,
          padding: '24px 12px',
          fontFamily: font,
          color: C.ink,
        }}
      >
        <Container style={{ maxWidth: '560px', margin: '0 auto' }}>
          <Section style={{ padding: '0 4px 14px' }}>
            <table role="presentation" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: C.primary,
                      color: '#ffffff',
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    L
                  </td>
                  <td style={{ paddingLeft: 10, fontWeight: 800, fontSize: 16, color: C.ink }}>
                    LAIRON EZ
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
          <Section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              padding: '24px 22px',
              border: `1px solid ${C.line}`,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: 800, margin: '0 0 14px', color: C.ink }}>
              {title}
            </Text>
            {children}
          </Section>
          <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', margin: '16px 0 0' }}>
            You’re receiving this because of activity in LAIRON EZ. Please don’t reply to this
            email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const P = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <Text
    style={{
      fontSize: 15,
      lineHeight: '22px',
      margin: '0 0 12px',
      color: muted ? C.muted : C.ink2,
    }}
  >
    {children}
  </Text>
)

export const Cta = ({ href, children }: { href: string; children: ReactNode }) => (
  <Section style={{ margin: '18px 0 4px' }}>
    <Button
      href={href}
      style={{
        backgroundColor: C.primary,
        color: '#ffffff',
        fontWeight: 700,
        fontSize: 15,
        padding: '12px 22px',
        borderRadius: 10,
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      {children}
    </Button>
  </Section>
)

export const Rule = () => <Hr style={{ borderColor: C.line, margin: '16px 0' }} />

export const Badge = ({
  tone,
  children,
}: {
  tone: 'ok' | 'danger' | 'info' | 'warn'
  children: ReactNode
}) => {
  const map = {
    ok: ['#dcf1e3', C.ok],
    danger: ['#fbe1de', C.danger],
    info: ['#dde8fb', C.primary],
    warn: ['#fbecd5', C.warn],
  } as const
  return (
    <span
      style={{
        backgroundColor: map[tone][0],
        color: map[tone][1],
        fontWeight: 700,
        fontSize: 12,
        padding: '3px 10px',
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  )
}

/** Label/value rows. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ margin: '0 0 8px' }}
    >
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td
              style={{
                fontSize: 13,
                color: C.muted,
                padding: '4px 12px 4px 0',
                verticalAlign: 'top',
                width: '38%',
              }}
            >
              {k}
            </td>
            <td style={{ fontSize: 14, color: C.ink, fontWeight: 600, padding: '4px 0' }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function DataTable({
  head,
  rows,
  widths,
}: {
  head: string[]
  rows: string[][]
  widths?: string[]
}) {
  const cell = {
    fontSize: 13,
    padding: '8px 6px',
    borderBottom: `1px solid ${C.line}`,
    verticalAlign: 'top' as const,
    color: C.ink,
  }
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: 'collapse', margin: '6px 0 4px' }}
    >
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              align="left"
              style={{
                ...cell,
                color: C.muted,
                fontSize: 11,
                textTransform: 'uppercase',
                backgroundColor: '#f4f6fa',
                width: widths?.[i],
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} style={cell}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
