'use client';

import { CalendarDays, LayoutDashboard, Megaphone, Send, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  { href: '/', rotulo: 'Visão geral', Icone: LayoutDashboard },
  { href: '/diario', rotulo: 'Dia a dia', Icone: CalendarDays },
  { href: '/trafego', rotulo: 'Tráfego', Icone: Megaphone },
  { href: '/publico', rotulo: 'Público', Icone: Users },
  { href: '/disparo', rotulo: 'Disparo e régua', Icone: Send },
];

export default function Nav() {
  const atual = usePathname();
  return (
    <nav className="nav" aria-label="Seções">
      {ITENS.map(({ href, rotulo, Icone }) => (
        <Link key={href} href={href} aria-current={atual === href ? 'page' : undefined}>
          <Icone aria-hidden="true" />
          <span>{rotulo}</span>
        </Link>
      ))}
    </nav>
  );
}
