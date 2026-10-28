/**
 * @fileoverview Sponsor Logos Component
 * Reusable component for displaying sponsor logos that can be easily updated for different partnerships
 */
import React from 'react';

interface SponsorLogoProps {
  src: string;
  alt: string;
  href?: string;
  className?: string;
}

interface SponsorLogosProps {
  leftSponsor?: SponsorLogoProps;
  rightSponsor?: SponsorLogoProps;
  className?: string;
}

/**
 * Individual sponsor logo component with optional link
 */
const SponsorLogo: React.FC<SponsorLogoProps> = ({ src, alt, href, className = "" }) => {
  const logoElement = (
    <img
      src={src}
      alt={alt}
      className={`h-10 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto object-contain transition-all hover:opacity-80 ${className}`}
    />
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
      >
        {logoElement}
      </a>
    );
  }

  return logoElement;
};

/**
 * Sponsor Logos Container Component
 *
 * Displays sponsor logos on either side of content with responsive behavior.
 * Logos automatically hide on smaller screens to avoid crowding.
 *
 * @param leftSponsor - Configuration for left side sponsor logo
 * @param rightSponsor - Configuration for right side sponsor logo
 * @param className - Additional CSS classes for the container
 */
export const SponsorLogos: React.FC<SponsorLogosProps> = ({
  leftSponsor,
  rightSponsor,
  className = ""
}) => {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {/* Left Sponsor */}
      {leftSponsor && (
        <div className="absolute -left-20 sm:-left-28 md:-left-32 lg:-left-36 xl:-left-40 top-1/2 transform -translate-y-1/2 pointer-events-auto">
          <SponsorLogo {...leftSponsor} />
        </div>
      )}

      {/* Right Sponsor */}
      {rightSponsor && (
        <div className="absolute -right-20 sm:-right-28 md:-right-32 lg:-right-36 xl:-right-40 top-1/2 transform -translate-y-1/2 pointer-events-auto">
          <SponsorLogo {...rightSponsor} />
        </div>
      )}
    </div>
  );
};

/**
 * Predefined sponsor configurations for easy swapping
 */
const sponsorConfigs = {
  predator: {
    src: '/assets/logos/predator-logo.png',
    alt: 'Predator Cues',
    href: 'https://predatorcues.com'
  },
  predatorYellow: {
    src: '/assets/logos/predator-logo-yellow.png',
    alt: 'Predator Cues',
    href: 'https://predatorcues.com'
  },
  bca: {
    src: '/assets/logos/bca-logo.png',
    alt: 'Billiard Congress of America',
    href: 'https://bca-pool.com'
  }
};

/**
 * Quick configuration component for current sponsors
 */
export const CurrentSponsors: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <SponsorLogos
      leftSponsor={sponsorConfigs.bca}
      rightSponsor={sponsorConfigs.predatorYellow}
      className={className}
    />
  );
};