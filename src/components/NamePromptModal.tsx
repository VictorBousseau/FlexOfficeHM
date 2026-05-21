'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NamePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  initialName?: string;
  /** Si false, la modale ne peut pas etre fermee sans valider (premiere visite). */
  dismissible?: boolean;
}

export function NamePromptModal({
  open,
  onOpenChange,
  onSubmit,
  initialName = '',
  dismissible = false,
}: NamePromptModalProps) {
  const [value, setValue] = useState(initialName);

  useEffect(() => {
    if (open) setValue(initialName);
  }, [open, initialName]);

  const trimmed = value.trim();

  const submit = () => {
    if (trimmed.length > 0) onSubmit(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // En mode non-dismissible, on ignore toute tentative de fermeture.
        if (next || dismissible) onOpenChange(next);
      }}
    >
      <DialogContent
        hideClose={!dismissible}
        onInteractOutside={(event) => {
          if (!dismissible) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (!dismissible) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {dismissible ? 'Changer mon nom' : 'Bienvenue sur Flex Office'}
          </DialogTitle>
          <DialogDescription>
            Indique ton prenom : il identifie tes reservations. Tu pourras le
            modifier plus tard depuis l&apos;en-tete.
          </DialogDescription>
        </DialogHeader>
        <input
          type="text"
          value={value}
          autoFocus
          placeholder="Ton prenom"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Prenom"
        />
        <DialogFooter>
          {dismissible && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          )}
          <Button onClick={submit} disabled={trimmed.length === 0}>
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
