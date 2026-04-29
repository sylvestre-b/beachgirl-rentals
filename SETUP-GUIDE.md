[build]
  publish = "."
  command = "node build.js"

[[redirects]]
  from = "/admin"
  to = "/404.html"
  status = 404

# The real admin path is defined in admin/index.html
# Change the folder name "manage-listings-apm" to something else for security
