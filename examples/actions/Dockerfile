FROM python:latest

# install kleinkram as CLI
RUN pip install kleinkram --force-reinstall

# copy entrypoint and make it executable
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# set entrypoint
ENTRYPOINT ["/entrypoint.sh"]