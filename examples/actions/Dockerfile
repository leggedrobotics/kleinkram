FROM python:latest

COPY ./entrypoint.sh /entrypoint.sh
RUN pip install kleinkram --force-reinstall
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]