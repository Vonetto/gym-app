export type BodyPartPath = {
  common?: string[];
  left?: string[];
  right?: string[];
};

export type BodyPart = {
  slug: string;
  color: string;
  path: BodyPartPath;
};
