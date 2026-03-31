type AutoMatixLogoProps = {
  className?: string;
  showSubtitle?: boolean;
};

export default function AutoMatixLogo({ className, showSubtitle = true }: AutoMatixLogoProps) {
  const src = showSubtitle ? '/automatrix-logo.svg' : '/automatrix-logo-mark.svg';
  return (
    <img className={className} src={src} alt="AutoMatix" />
  );
}
