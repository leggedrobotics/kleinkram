FROM python:latest

# install kleinkram as CLI
RUN pip install kleinkram --pre --force-reinstall

# copy entrypoint and make it executable
COPY ./entrypoint.sh /entrypoint.sh
COPY ./entrypoint2.sh /entrypoint2.sh

RUN chmod +x /entrypoint.sh
RUN chmod +x /entrypoint2.sh

# set entrypoint
ENTRYPOINT ["/entrypoint.sh"]