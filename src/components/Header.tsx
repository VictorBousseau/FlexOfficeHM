'use client';

import Link from 'next/link';
import { CalendarDays, MapPin, UserCog } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface HeaderProps {
  userName: string;
  onChangeName: () => void;
}

export function Header({ userName, onChangeName }: HeaderProps) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold leading-tight">
            Flex Office — 3eme etage Rennes
          </h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <MapPin className="mr-1 h-4 w-4" />
              Plan
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/mes-reservations">
              <CalendarDays className="mr-1 h-4 w-4" />
              Mes reservations
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onChangeName}>
            <UserCog className="mr-1 h-4 w-4" />
            {userName.trim() ? userName : 'Definir mon nom'}
          </Button>
        </nav>
      </div>
    </header>
  );
}
