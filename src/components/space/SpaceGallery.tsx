import { SpaceImage } from "./SpaceImage";

export function SpaceGallery({ photos, name, spaceType }: { photos: { id: string; url: string; alt: string | null }[]; name: string; spaceType: string }) {
  const [first, ...rest] = photos;
  if (!first) return <SpaceImage src={null} alt={name} spaceType={spaceType} className="h-[300px] w-full rounded-2xl sm:h-[420px]" />;
  return (
    <div className={`grid gap-2 ${rest.length ? "sm:grid-cols-[2fr_1fr]" : ""}`}>
      <SpaceImage src={first.url} alt={first.alt ?? name} spaceType={spaceType} className={`w-full rounded-2xl ${rest.length ? "h-[300px] sm:h-[460px]" : "h-[300px] sm:h-[420px]"}`} />
      {rest.length ? (
        <div className="grid grid-rows-2 gap-2">
          {rest.slice(0, 2).map((p) => (
            <SpaceImage key={p.id} src={p.url} alt={p.alt ?? name} spaceType={spaceType} className="h-[150px] w-full rounded-2xl sm:h-[226px]" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
