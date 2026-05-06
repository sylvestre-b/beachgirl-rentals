// address-autocomplete.js — custom Decap CMS widget
// Provides typeahead address suggestions using Photon (free OSM-based
// geocoder, no API key required). Selected addresses are saved as a
// formatted string. The build step's geocoder fills in lat/lng on next
// deploy from the address, so we only need the address string here.

(function () {
  'use strict';

  // Wait until Decap exposes its CMS global
  function ready(cb) {
    if (window.CMS) cb();
    else setTimeout(() => ready(cb), 100);
  }

  ready(function () {
    const h = window.CMS.h || window.h;
    const React = window.CMS.React || window.React;
    if (!h || !React) {
      console.warn(
        '[address-autocomplete] Decap React not available — falling back to plain string widget.'
      );
      return;
    }

    class AddressAutocompleteControl extends React.Component {
      constructor(props) {
        super(props);
        this.state = { suggestions: [], showing: false, loading: false };
        this.timer = null;
        this.handleChange = this.handleChange.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.fetchSuggestions = this.fetchSuggestions.bind(this);
      }

      handleChange(e) {
        const value = e.target.value;
        this.props.onChange(value);
        clearTimeout(this.timer);
        if (!value || value.length < 4) {
          this.setState({ suggestions: [], showing: false });
          return;
        }
        this.timer = setTimeout(() => this.fetchSuggestions(value), 350);
      }

      handleBlur() {
        // Slight delay so click on suggestion fires first
        setTimeout(() => this.setState({ showing: false }), 200);
      }

      handleFocus() {
        if (this.state.suggestions.length) {
          this.setState({ showing: true });
        }
      }

      fetchSuggestions(query) {
        this.setState({ loading: true });
        const url =
          'https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=6&lang=en';
        fetch(url)
          .then(r => r.json())
          .then(data => {
            const suggestions = (data.features || [])
              .map(f => {
                const p = f.properties || {};
                const street = [p.housenumber, p.street].filter(Boolean).join(' ');
                const cityLine = [p.city, p.state, p.postcode].filter(Boolean).join(', ');
                const country = p.country;
                const label = [street, cityLine, country].filter(Boolean).join(', ');
                return {
                  label,
                  short: [street || p.name, p.city].filter(Boolean).join(', '),
                  city: cityLine,
                  lat: f.geometry.coordinates[1],
                  lng: f.geometry.coordinates[0],
                };
              })
              .filter(s => s.label);
            this.setState({ suggestions, showing: true, loading: false });
          })
          .catch(err => {
            console.warn('[address-autocomplete] fetch failed:', err);
            this.setState({ loading: false, showing: false });
          });
      }

      selectSuggestion(s) {
        this.props.onChange(s.label);
        this.setState({ showing: false });
      }

      render() {
        const value = this.props.value || '';
        const forID = this.props.forID;
        const className = this.props.classNameWrapper;

        return h(
          'div',
          { style: { position: 'relative' } },
          h('input', {
            id: forID,
            type: 'text',
            className: className,
            value: value,
            onChange: this.handleChange,
            onBlur: this.handleBlur,
            onFocus: this.handleFocus,
            placeholder: 'e.g. 123 Beach St, Old Orchard Beach, ME',
            autoComplete: 'off',
            style: { width: '100%' },
          }),
          this.state.loading &&
            h(
              'div',
              {
                style: {
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 12,
                  color: '#888',
                  pointerEvents: 'none',
                },
              },
              'Searching…'
            ),
          this.state.showing &&
            this.state.suggestions.length > 0 &&
            h(
              'ul',
              {
                style: {
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #d0d4d9',
                  borderRadius: 4,
                  listStyle: 'none',
                  margin: '4px 0 0',
                  padding: 0,
                  zIndex: 1000,
                  maxHeight: 280,
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                },
              },
              this.state.suggestions.map((s, i) =>
                h(
                  'li',
                  {
                    key: i,
                    onMouseDown: () => this.selectSuggestion(s),
                    style: {
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom:
                        i < this.state.suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      fontSize: 14,
                    },
                    onMouseEnter: e => (e.currentTarget.style.background = '#f7f3ec'),
                    onMouseLeave: e => (e.currentTarget.style.background = '#fff'),
                  },
                  h('div', { style: { fontWeight: 600, color: '#1c2528' } }, s.short || s.label),
                  s.city &&
                    h('div', { style: { fontSize: 12, color: '#6b7a80', marginTop: 2 } }, s.city)
                )
              )
            )
        );
      }
    }

    // Schema: just a string. Build step handles geocoding.
    const schema = {
      properties: {
        default: { type: 'string' },
      },
    };

    window.CMS.registerWidget('address-autocomplete', AddressAutocompleteControl, null, schema);
  });
})();
