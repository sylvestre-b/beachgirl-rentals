backend:
  name: git-gateway
  branch: main

media_folder: "photos"
public_folder: "/photos"

collections:
  - name: "properties"
    label: "Properties"
    label_singular: "Property"
    folder: "_listings"
    create: true
    delete: true
    slug: "{{slug}}"
    fields:
      - { label: "Property Name", name: "title", widget: "string", hint: "e.g. The Harborview Cottage" }
      - { label: "Location", name: "location", widget: "string", hint: "e.g. Rockport, MA" }
      - { label: "Property Type", name: "type", widget: "select", options: ["Cottage", "Cape", "Ranch", "Colonial", "Condo", "Apartment", "Studio"], default: "Cottage" }
      - { label: "Bedrooms", name: "bedrooms", widget: "number", min: 0, max: 10, default: 2 }
      - { label: "Bathrooms", name: "bathrooms", widget: "number", min: 1, max: 8, value_type: "float", step: 0.5, default: 1 }
      - { label: "Max Guests", name: "guests", widget: "number", min: 1, max: 20, default: 4 }
      - { label: "Price Per Week", name: "price", widget: "string", hint: "e.g. $2,400" }
      - { label: "Cover Photo", name: "photo", widget: "image" }
      - { label: "Description", name: "description", widget: "text", hint: "A short description renters will see on the listing tile." }
      - label: "Weekly Availability"
        name: "weeks"
        widget: "list"
        summary: "{{fields.dates}} — {{fields.status}}"
        fields:
          - { label: "Week Dates", name: "dates", widget: "string", hint: "e.g. Jun 28 – Jul 5" }
          - { label: "Status", name: "status", widget: "select", options: ["Available", "Booked"], default: "Available" }
      - { label: "Active Listing", name: "active", widget: "boolean", default: true, hint: "Uncheck to hide this property without deleting it." }
