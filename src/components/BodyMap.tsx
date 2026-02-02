import { useMemo } from 'react';
import { bodyFront } from '../assets/body-highlighter/bodyFront';
import { bodyBack } from '../assets/body-highlighter/bodyBack';
import type { BodyPart } from '../assets/body-highlighter/types';
import { buildSlugVolumes, getIntensityRatio, getIntensityColor } from './bodyMapData';

export type BodyMapView = 'front' | 'back';

type BodyMapProps = {
  view: BodyMapView;
  muscleVolumes: Record<string, number>;
  activeSlug?: string | null;
  onSelect?: (slug: string) => void;
};

const VIEW_BOX: Record<BodyMapView, string> = {
  front: '0 0 724 1448',
  back: '724 0 724 1448'
};

const FRONT_SLUGS = new Set(bodyFront.map((part) => part.slug));
const BACK_SLUGS = new Set(bodyBack.map((part) => part.slug));

const getFillColor = (intensity: number, fallback: string) =>
  intensity > 0 ? getIntensityColor(intensity) : fallback;

const renderPaths = (
  paths: string[] | undefined,
  fill: string,
  keyPrefix: string,
  onSelect?: () => void,
  isActive?: boolean
) =>
  (paths ?? []).map((path, index) => (
    <path
      key={`${keyPrefix}-${index}`}
      d={path}
      fill={fill}
      onClick={onSelect}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
      stroke={isActive ? '#ffffff' : undefined}
      strokeWidth={isActive ? 2 : undefined}
    />
  ));

const getDataForView = (view: BodyMapView) => (view === 'front' ? bodyFront : bodyBack);

export function BodyMap({ view, muscleVolumes, activeSlug, onSelect }: BodyMapProps) {
  const slugVolumes = useMemo(() => buildSlugVolumes(muscleVolumes), [muscleVolumes]);

  const { data, max } = useMemo(() => {
    const data = getDataForView(view);
    const activeSlugs = view === 'front' ? FRONT_SLUGS : BACK_SLUGS;
    const max = Math.max(0, ...Array.from(activeSlugs).map((slug) => slugVolumes[slug] ?? 0));
    return { data, max };
  }, [view, slugVolumes]);

  const getIntensity = (slug: BodyPart['slug']) => {
    if (!slug || max <= 0) return 0;
    return Math.min(1, getIntensityRatio(slugVolumes[slug] ?? 0, max));
  };

  return (
    <svg viewBox={VIEW_BOX[view]} aria-label="Mapa muscular">
      {data.map((part) => {
        const intensity = getIntensity(part.slug);
        const fill = getFillColor(intensity, part.color ?? '#3f3f3f');
        const isActive = part.slug === activeSlug;
        const handleSelect = onSelect ? () => onSelect(part.slug) : undefined;
        return (
          <g key={part.slug}>
            {renderPaths(part.path?.common, fill, `${part.slug}-common`, handleSelect, isActive)}
            {renderPaths(part.path?.left, fill, `${part.slug}-left`, handleSelect, isActive)}
            {renderPaths(part.path?.right, fill, `${part.slug}-right`, handleSelect, isActive)}
          </g>
        );
      })}
    </svg>
  );
}
