---
applyTo: '*.tsx,*.astro'
---
## Frontend

### General Guidelines

- Use Astro components (.astro) for static content and layout
- Implement framework components in React only when interactivity is needed

### Guidelines for Styling

#### Color Palette

The application uses a warm beige color system. Always apply these colors when creating or modifying components:

**Background Colors:**
- Main background: `bg-[#FAF8F5]` - warm beige background for pages
- Card/Surface: `bg-white` - pure white for cards and surfaces
- Muted background: `bg-[#D4A574]/10` - subtle warm accent backgrounds

**Border Colors:**
- Default border: `border-[#E5DDD5]` - soft beige borders
- Hover border: `border-[#D4A574]` - warm golden accent on hover
- Subtle border: `border-[#E5DDD5]/60` - lighter borders

**Text Colors:**
- Primary text: `text-[#4A3F35]` - warm brown for main content
- Secondary text: `text-[#8B7E74]` - muted beige for secondary content
- Placeholder text: `placeholder:text-[#A89F94]` - light beige for placeholders

**Accent Colors:**
- Primary accent: `bg-[#D4A574]` - warm golden beige for buttons/highlights
- Accent hover: `bg-[#C9965E]` - darker golden on hover
- Accent text: `text-[#D4A574]` - warm golden for icons/links

**Status Colors:**
- Success: `text-[#9CAA7F]` / `bg-[#9CAA7F]` - olive green
- Error/Failure: `text-[#C17A6F]` / `bg-[#C17A6F]` - warm terracotta
- Warning: `text-[#D4A574]` / `bg-[#D4A574]` - honey gold
- Info: `text-[#A89F94]` - warm gray

**Interactive Elements:**
- Focus ring: `focus-visible:ring-[#D4A574]/30`
- Hover background: `hover:bg-[#D4A574]/10`
- Active state: Use darker shade `#C9965E`

#### Tailwind

- Use the @layer directive to organize styles into components, utilities, and base layers
- Use arbitrary values with square brackets (e.g., w-[123px]) for precise one-off designs
- Implement the Tailwind configuration file for customizing theme, plugins, and variants
- Leverage the theme() function in CSS for accessing Tailwind theme values
- Implement dark mode with the dark: variant
- Use responsive variants (sm:, md:, lg:, etc.) for adaptive designs
- Leverage state variants (hover:, focus-visible:, active:, etc.) for interactive elements

### Guidelines for Accessibility

#### ARIA Best Practices

- Use ARIA landmarks to identify regions of the page (main, navigation, search, etc.)
- Apply appropriate ARIA roles to custom interface elements that lack semantic HTML equivalents
- Set aria-expanded and aria-controls for expandable content like accordions and dropdowns
- Use aria-live regions with appropriate politeness settings for dynamic content updates
- Implement aria-hidden to hide decorative or duplicative content from screen readers
- Apply aria-label or aria-labelledby for elements without visible text labels
- Use aria-describedby to associate descriptive text with form inputs or complex elements
- Implement aria-current for indicating the current item in a set, navigation, or process
- Avoid redundant ARIA that duplicates the semantics of native HTML elements