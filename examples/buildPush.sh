docker compose -f docker-compose.$1.yml build
for service in $(docker compose -f docker-compose.$1.yml config --services); do
    image=$(docker compose -f docker-compose.$1.yml config | awk "/$service:$/ {flag=1} flag && /image:/ {print \$2; exit}")
    echo "Pushing $image to Docker Hub...."
    docker push "$image"
done