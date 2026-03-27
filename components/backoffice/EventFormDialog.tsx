"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { EventListItemDto, GenreDto } from "@grub/contracts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";

const EVENT_SOURCE_OPTIONS = [
  "manual",
  "ticketmaster",
  "ticketmaster-pe",
  "teleticket",
  "joinnus",
  "passline",
  "vastion",
  "tikpe",
] as const;

const optionalPositiveNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
}, z.number().positive().nullable());

const eventSchema = z.object({
  name: z.string().min(3, "Mínimo 3 caracteres"),
  date: z.string().min(1, "Fecha requerida"),
  cover_url: z.string().url("URL inválida").optional().or(z.literal("")),
  venue: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().length(2).default("PE"),
  ticket_url: z.string().url("URL inválida").optional().or(z.literal("")),
  price_min: optionalPositiveNumber.optional(),
  price_max: optionalPositiveNumber.optional(),
  source: z
    .enum(EVENT_SOURCE_OPTIONS)
    .default("manual"),
  genre_ids: z.array(z.number()).default([]),
  vertical_title: z.string().optional(),
  horizontal_title: z.string().optional(),
  category_badge: z.string().optional(),
  vertical_image_fit: z.enum(["cover", "contain"]).default("cover"),
  horizontal_image_fit: z.enum(["cover", "contain"]).default("cover"),
  is_active: z.boolean().default(true),
});

type EventFormValues = z.input<typeof eventSchema>;

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (event: EventListItemDto) => void | Promise<void>;
  accessToken: string;
  event?: EventListItemDto | null;
}

function slugifyGenre(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEventSource(source: string | null | undefined): EventFormValues["source"] {
  const normalizedSource = (source ?? "") as EventFormValues["source"] | "";
  return EVENT_SOURCE_OPTIONS.includes(normalizedSource as typeof EVENT_SOURCE_OPTIONS[number])
    ? (normalizedSource as EventFormValues["source"])
    : "manual";
}

export function EventFormDialog({
  open,
  onOpenChange,
  onSuccess,
  accessToken,
  event,
}: EventFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [genres, setGenres] = useState<GenreDto[]>([]);
  const [genresLoading, setGenresLoading] = useState(false);
  const [genreCreatorOpen, setGenreCreatorOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [newGenreSlug, setNewGenreSlug] = useState("");
  const [creatingGenre, setCreatingGenre] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      country_code: "PE",
      source: "manual",
      vertical_image_fit: "cover",
      horizontal_image_fit: "cover",
      is_active: true,
    },
  });

  useEffect(() => {
    if (!open) return;

    if (event) {
      setSubmitError(null);
      reset({
        name: event.name,
        date: event.date ? event.date.slice(0, 16) : "",
        cover_url: event.cover_url ?? "",
        venue: event.venue ?? "",
        city: event.city ?? "",
        country_code: event.country_code ?? "PE",
        ticket_url: event.ticket_url ?? "",
        price_min: event.price_min ?? null,
        price_max: event.price_max ?? null,
        source: normalizeEventSource(event.source),
        genre_ids: (event.event_genres ?? [])
          .map((item) => item.genres?.id)
          .filter((value): value is number => typeof value === "number"),
        vertical_title: event.presentation?.vertical_title ?? "",
        horizontal_title: event.presentation?.horizontal_title ?? "",
        category_badge: event.presentation?.category_badge ?? "",
        vertical_image_fit: event.presentation?.vertical_image_fit ?? "cover",
        horizontal_image_fit: event.presentation?.horizontal_image_fit ?? "cover",
        is_active: event.is_active ?? true,
      });
      return;
    }

    setSubmitError(null);
    reset({
      name: "",
      date: "",
      cover_url: "",
      venue: "",
      city: "",
      country_code: "PE",
      ticket_url: "",
      price_min: null,
      price_max: null,
      source: "manual",
      genre_ids: [],
      vertical_title: "",
      horizontal_title: "",
      category_badge: "",
      vertical_image_fit: "cover",
      horizontal_image_fit: "cover",
      is_active: true,
    });
  }, [event, open, reset]);

  useEffect(() => {
    if (!open) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    let cancelled = false;

    const loadGenres = async () => {
      setGenresLoading(true);
      try {
        const res = await fetch("/api/admin/genres");
        const json = (await res.json().catch(() => ({}))) as {
          genres?: GenreDto[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? `Error ${res.status}`);
        }
        if (!cancelled) {
          setGenres(json.genres ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setSubmitError(
            error instanceof Error
              ? `No se pudieron cargar los géneros. ${error.message}`
              : "No se pudieron cargar los géneros.",
          );
        }
      } finally {
        if (!cancelled) {
          setGenresLoading(false);
        }
      }
    };

    void loadGenres();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const isActive = watch("is_active");
  const source = watch("source");
  const verticalImageFit = watch("vertical_image_fit");
  const horizontalImageFit = watch("horizontal_image_fit");
  const selectedGenreIdsValue = watch("genre_ids");
  const selectedGenreIds = Array.isArray(selectedGenreIdsValue)
    ? selectedGenreIdsValue
    : [];
  const isEditing = Boolean(event);

  const createGenre = async () => {
    const name = newGenreName.trim();
    const slug = (newGenreSlug.trim() || slugifyGenre(name));

    if (!name) {
      setSubmitError("Escribe un nombre para el género.");
      return;
    }

    setSubmitError(null);
    setCreatingGenre(true);
    try {
      const res = await fetch("/api/admin/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        genre?: GenreDto;
        error?: string;
      };

      if (!res.ok || !json.genre) {
        throw new Error(json.error ?? `Error ${res.status}`);
      }

      setGenres((current) =>
        [...current, json.genre!].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setValue(
        "genre_ids",
        selectedGenreIds.includes(json.genre.id)
          ? selectedGenreIds
          : [...selectedGenreIds, json.genre.id],
        { shouldDirty: true },
      );
      setNewGenreName("");
      setNewGenreSlug("");
      setGenreCreatorOpen(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? `No se pudo crear el género. ${error.message}`
          : "No se pudo crear el género.",
      );
    } finally {
      setCreatingGenre(false);
    }
  };

  const onSubmit = async (data: EventFormValues) => {
    setSubmitError(null);
    try {
      const payload = {
        name: data.name,
        date: data.date,
        cover_url: data.cover_url,
        venue: data.venue,
        city: data.city,
        country_code: data.country_code,
        ticket_url: data.ticket_url,
        price_min: data.price_min,
        price_max: data.price_max,
        source: data.source,
        genre_ids: data.genre_ids,
        is_active: data.is_active,
        presentation: {
          vertical_title: data.vertical_title,
          horizontal_title: data.horizontal_title,
          category_badge: data.category_badge,
          vertical_image_fit: data.vertical_image_fit,
          horizontal_image_fit: data.horizontal_image_fit,
        },
      };

      const endpoint = event ? `/api/admin/events/${event.id}` : "/api/admin/events";
      const res = await fetch(endpoint, {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({})) as { error?: string; event?: EventListItemDto };

      if (!res.ok || !json.event) {
        throw new Error(json.error ?? `Error ${res.status}`);
      }

      reset();
      await onSuccess?.(json.event);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to create event:", err);
      setSubmitError(
        err instanceof Error
          ? `No se pudo guardar el evento. ${err.message}`
          : "No se pudo guardar el evento."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen w-screen max-w-[min(1200px,92vw)] translate-x-0 translate-y-0 rounded-none border-l border-border bg-background p-0">
        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="border-b border-border bg-background/95 px-8 py-6 backdrop-blur">
            <DialogTitle className="text-2xl">{isEditing ? "Editar evento" : "Nuevo evento"}</DialogTitle>
            <DialogDescription className="max-w-3xl text-sm">
              {isEditing
                ? "Ajusta el dato base, corrige catálogo y define cómo se presenta el evento dentro de la app desde un solo lugar."
                : "Crea un evento manual, define su metadata principal y prepara su presentación para publicarlo en el catálogo."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="space-y-6">
                <div className="rounded-2xl border border-border/70 bg-card/50 p-5">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-foreground">Información base</h4>
                    <p className="text-xs text-muted-foreground">
                      Nombre, fecha, venue, fuente y enlaces principales del evento.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input id="name" {...register("name")} placeholder="Nombre del evento" className="h-12 text-base" />
                      {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="date">Fecha</Label>
                        <Input id="date" type="datetime-local" {...register("date")} className="h-12" />
                        {errors.date ? <p className="text-xs text-destructive">{errors.date.message}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cover_url">Cover URL</Label>
                        <Input id="cover_url" {...register("cover_url")} placeholder="https://..." className="h-12" />
                        {errors.cover_url ? <p className="text-xs text-destructive">{errors.cover_url.message}</p> : null}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="venue">Venue</Label>
                        <Input id="venue" {...register("venue")} placeholder="Nombre del lugar" className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Ciudad</Label>
                        <Input id="city" {...register("city")} placeholder="Lima" className="h-12" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ticket_url">URL de tickets</Label>
                      <Input id="ticket_url" {...register("ticket_url")} placeholder="https://..." className="h-12" />
                      {errors.ticket_url ? <p className="text-xs text-destructive">{errors.ticket_url.message}</p> : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="price_min">Precio mínimo</Label>
                        <Input id="price_min" type="number" step="0.01" {...register("price_min")} placeholder="0.00" className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price_max">Precio máximo</Label>
                        <Input id="price_max" type="number" step="0.01" {...register("price_max")} placeholder="0.00" className="h-12" />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="country_code">País</Label>
                        <Input id="country_code" {...register("country_code")} placeholder="PE" maxLength={2} className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fuente</Label>
                        <Select
                          value={source}
                          onValueChange={(v) => setValue("source", v as EventFormValues["source"])}
                        >
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Seleccionar fuente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="ticketmaster">Ticketmaster</SelectItem>
                            <SelectItem value="teleticket">Teleticket</SelectItem>
                            <SelectItem value="ticketmaster-pe">Ticketmaster PE</SelectItem>
                            <SelectItem value="joinnus">Joinnus</SelectItem>
                            <SelectItem value="passline">Passline</SelectItem>
                            <SelectItem value="vastion">Vastion</SelectItem>
                            <SelectItem value="tikpe">Tikpe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card/50 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Géneros</h4>
                      <p className="text-xs text-muted-foreground">
                        Vincula el evento al catálogo de géneros y crea uno nuevo si todavía no existe.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setGenreCreatorOpen((current) => !current)}
                    >
                      {genreCreatorOpen ? "Cerrar" : "Nuevo género"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {genreCreatorOpen ? (
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <Input
                            value={newGenreName}
                            onChange={(event) => {
                              const value = event.target.value;
                              setNewGenreName(value);
                              setNewGenreSlug(slugifyGenre(value));
                            }}
                            placeholder="Nombre del género"
                            className="h-11"
                          />
                          <Input
                            value={newGenreSlug}
                            onChange={(event) => setNewGenreSlug(slugifyGenre(event.target.value))}
                            placeholder="slug-del-genero"
                            className="h-11"
                          />
                          <Button type="button" onClick={createGenre} disabled={creatingGenre} className="h-11">
                            {creatingGenre ? "Creando..." : "Crear"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <Select
                      value=""
                      onValueChange={(genreId) => {
                        const numericGenreId = Number(genreId);
                        const nextGenreIds = selectedGenreIds.includes(numericGenreId)
                          ? selectedGenreIds
                          : [...selectedGenreIds, numericGenreId];
                        setValue("genre_ids", nextGenreIds, { shouldDirty: true });
                      }}
                      disabled={genresLoading || genres.length === 0}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue
                          placeholder={
                            genresLoading
                              ? "Cargando géneros..."
                              : genres.length
                                ? "Selecciona uno o más géneros"
                                : "No hay géneros disponibles"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map((genre) => (
                          <SelectItem key={genre.id} value={String(genre.id)}>
                            {genre.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedGenreIds.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedGenreIds.map((genreId) => {
                          const genre = genres.find((item) => item.id === genreId);
                          return (
                            <button
                              key={genreId}
                              type="button"
                              className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-foreground transition hover:border-destructive/50 hover:text-destructive"
                              onClick={() =>
                                setValue(
                                  "genre_ids",
                                  selectedGenreIds.filter((value) => value !== genreId),
                                  { shouldDirty: true },
                                )
                              }
                            >
                              {genre?.name ?? genreId} x
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Elige los géneros que quieres asociar a este evento.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="rounded-2xl border border-border/70 bg-card/50 p-5">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-foreground">Presentación en app</h4>
                    <p className="text-xs text-muted-foreground">
                      Ajusta el título, badge e imagen de la card vertical y horizontal sin tocar el dato base.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="vertical_title">Título card vertical</Label>
                      <Input id="vertical_title" {...register("vertical_title")} placeholder="Usar nombre base del evento" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horizontal_title">Título card horizontal</Label>
                      <Input id="horizontal_title" {...register("horizontal_title")} placeholder="Usar nombre base del evento" className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category_badge">Badge vertical</Label>
                      <Input id="category_badge" {...register("category_badge")} placeholder="Rock, Pop, Live..." className="h-11" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Ajuste imagen vertical</Label>
                        <Select
                          value={verticalImageFit}
                          onValueChange={(value) =>
                            setValue("vertical_image_fit", value as EventFormValues["vertical_image_fit"], {
                              shouldDirty: true,
                            })
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Ajuste vertical" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cover">Cover</SelectItem>
                            <SelectItem value="contain">Contain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Ajuste imagen horizontal</Label>
                        <Select
                          value={horizontalImageFit}
                          onValueChange={(value) =>
                            setValue("horizontal_image_fit", value as EventFormValues["horizontal_image_fit"], {
                              shouldDirty: true,
                            })
                          }
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Ajuste horizontal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cover">Cover</SelectItem>
                            <SelectItem value="contain">Contain</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card/50 p-5">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-foreground">Estado del evento</h4>
                    <p className="text-xs text-muted-foreground">
                      Controla si el evento permanece visible en el catálogo activo.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Activo</div>
                      <div className="text-xs text-muted-foreground">
                        Si lo desactivas, el evento sale del catálogo visible para usuarios.
                      </div>
                    </div>
                    <Switch
                      id="is_active"
                      checked={isActive}
                      onCheckedChange={(v) => setValue("is_active", v)}
                    />
                  </div>
                </div>

                {submitError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {submitError}
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-background/95 px-8 py-5 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Crear evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
