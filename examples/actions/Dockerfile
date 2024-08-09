FROM python:latest

# install kleinkram as CLI
RUN pip install kleinkram==0.5.0.dev20240808145046 --force-reinstall

# copy entrypoint and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# set entrypoint
ENTRYPOINT ["/entrypoint.sh"]